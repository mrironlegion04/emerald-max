import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; procedureId: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { procedureId } = await params
  await prisma.wOProcedure.delete({ where: { id: procedureId } })
  return NextResponse.json({ success: true })
}
