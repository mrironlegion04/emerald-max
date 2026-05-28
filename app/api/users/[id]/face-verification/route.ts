import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'

// POST: Enable face verification for a user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || (session.role !== 'ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id: userId } = await params
    const { enable } = await req.json()

    if (!enable) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Update user to enable face verification
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        hasFaceVerification: true,
        lastFaceVerifyAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Face verification enabled',
      lastFaceVerifyAt: user.lastFaceVerifyAt,
    })
  } catch (error) {
    console.error('Face verification enable error:', error)
    return NextResponse.json({ error: 'Failed to enable face verification' }, { status: 500 })
  }
}

// DELETE: Disable face verification for a user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.userId || (session.role !== 'ADMIN' && session.role !== 'MANAGER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id: userId } = await params

    // Update user to disable face verification
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasFaceVerification: false,
        lastFaceVerifyAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Face verification disabled',
    })
  } catch (error) {
    console.error('Face verification disable error:', error)
    return NextResponse.json({ error: 'Failed to disable face verification' }, { status: 500 })
  }
}
