import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    const { id } = await params
    const { templateId } = await request.json()
    if (!templateId) return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
    
    const template = await prisma.bOMTemplate.findUnique({
      where: { id: templateId },
      include: { parts: true }
    })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    if (template.parts.length > 0) {
      await prisma.assetPart.createMany({
        data: template.parts.map(tp => ({
          assetId: id,
          partId: tp.partId,
          expectedQuantity: tp.expectedQuantity
        })),
        skipDuplicates: true
      })
    }
    return NextResponse.json({ success: true, partsAdded: template.parts.length })
  } catch (error) {
    console.error('Error applying BOM:', error)
    return NextResponse.json({ error: 'Failed to apply BOM template' }, { status: 500 })
  }
}
