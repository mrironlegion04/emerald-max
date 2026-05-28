import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string, partId: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    const { id, partId } = await params
    await prisma.bOMTemplatePart.delete({
      where: { templateId_partId: { templateId: id, partId } }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove part' }, { status: 500 })
  }
}
