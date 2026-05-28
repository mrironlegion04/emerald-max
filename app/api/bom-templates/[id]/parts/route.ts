import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    const { id } = await params
    const { partId, expectedQuantity = 1 } = await request.json()
    
    const templatePart = await prisma.bOMTemplatePart.create({
      data: { templateId: id, partId, expectedQuantity: Number(expectedQuantity) || 1 },
      include: { part: true }
    })
    return NextResponse.json(templatePart)
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Part already in template' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to add part' }, { status: 500 })
  }
}
