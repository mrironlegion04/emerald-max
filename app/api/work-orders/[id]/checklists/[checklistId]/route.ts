import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; checklistId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { checklistId } = await params
  await prisma.wOChecklist.delete({ where: { id: checklistId } })
  return NextResponse.json({ success: true })
}