import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page   = parseInt(searchParams.get('page')   ?? '1')
    const limit  = parseInt(searchParams.get('limit')  ?? '50')
    const entity = searchParams.get('entity') ?? ''
    const action = searchParams.get('action') ?? ''
    const search = searchParams.get('search') ?? ''

    const where: Record<string, unknown> = {}
    if (entity) where.entity = entity
    if (action) where.action = action
    if (search) {
      where.OR = [
        { entityName: { contains: search, mode: 'insensitive' } },
        { userName:   { contains: search, mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }
}