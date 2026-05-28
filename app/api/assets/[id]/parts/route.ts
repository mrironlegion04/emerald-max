import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { partId, expectedQuantity = 1 } = await request.json()

    if (!partId) {
      return NextResponse.json({ error: 'Part ID is required' }, { status: 400 })
    }

    const assetPart = await prisma.assetPart.create({
      data: {
        assetId: id,
        partId,
        expectedQuantity: Number(expectedQuantity) || 1,
      },
      include: {
        part: true,
      }
    })

    return NextResponse.json(assetPart)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Part is already linked to this asset' }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to link part to asset' }, { status: 500 })
  }
}
