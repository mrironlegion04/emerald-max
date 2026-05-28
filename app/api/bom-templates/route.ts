import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  try {
    const templates = await prisma.bOMTemplate.findMany({
      include: {
        _count: { select: { parts: true } },
        parts: { include: { part: true } }
      },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(templates)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    const { name, description } = await request.json()
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    
    const template = await prisma.bOMTemplate.create({
      data: { name, description }
    })
    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
