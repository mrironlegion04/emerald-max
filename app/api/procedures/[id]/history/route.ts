import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const versions = await prisma.procedureVersion.findMany({
      where: { procedureId: id },
      orderBy: { versionNumber: 'desc' },
      take: 50,
    })
    return NextResponse.json(versions)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch version history' }, { status: 500 })
  }
}
