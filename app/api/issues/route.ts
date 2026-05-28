import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { IssueService } from '@/lib/services/issue-service'
import { z } from 'zod'

const createSchema = z.object({
  code:      z.string().optional().default(''),
  title:     z.string().min(1, 'Title is required'),
  domainIds: z.array(z.string()),
  severity:  z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  isGlobal:  z.boolean().optional().default(false),
}).refine((data) => data.domainIds.length > 0 || data.isGlobal, {
  message: 'Select at least one domain, or mark as a global issue',
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const search     = searchParams.get('search')?.trim()
    const domainId   = searchParams.get('domainId')?.trim()
    const isGlobal   = searchParams.get('isGlobal')?.trim()

    // No categoryId param at all → admin/manager overview
    if (categoryId === null) {
      const where: Record<string, unknown> = {}
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { code:  { contains: search, mode: 'insensitive' } },
        ]
      }
      if (domainId) {
        where.domains = { some: { domainId } }
      }
      if (isGlobal === 'true') {
        where.isGlobal = true
      }

      const issues = await prisma.issue.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        include: {
          domains: { include: { domain: true } },
          _count:  { select: { workOrders: true } },
        },
      })
      return NextResponse.json(issues)
    }

    // Issue picker for WO form — uses fallback hierarchy.
    // When categoryId is empty string (no category on asset), getFallbackIssues handles it.
    const groups = await IssueService.getIssuesForCategory(categoryId || null, { search })
    return NextResponse.json(groups)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const body = await request.json()
    let { code, title, domainIds, severity, isGlobal } = createSchema.parse(body)

    if (!code || code.trim() === '') {
      const count = await prisma.issue.count()
      code = `ISS-${String(count + 1).padStart(3, '0')}`
    } else {
      code = code.trim()
    }

    const issue = await prisma.issue.create({
      data: {
        code,
        title,
        severity,
        isGlobal,
        ...(isGlobal ? {} : {
          domains: {
            create: domainIds.map(domainId => ({ domainId })),
          },
        }),
      },
      include: {
        domains: { include: { domain: true } },
        _count:  { select: { workOrders: true } },
      },
    })
    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 })
  }
}
