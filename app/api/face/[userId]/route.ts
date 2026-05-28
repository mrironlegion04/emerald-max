import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { removeFaceEnrollment, checkFaceServiceHealth } from '@/lib/face-service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await params

    // Check permissions - user can delete their own or admins can delete anyone's
    if (user.userId !== userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You can only delete your own face data' },
        { status: 403 }
      )
    }

    // Get user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, hasFaceVerification: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!targetUser.hasFaceVerification) {
      return NextResponse.json(
        { error: 'User has no face verification enrolled' },
        { status: 400 }
      )
    }

    // Delete from face service (user_id is the key)
    const isHealthy = await checkFaceServiceHealth()
    if (isHealthy) {
      try {
        await removeFaceEnrollment(userId)
      } catch (error) {
        console.error('Failed to delete face enrollment:', error)
      }
    }

    // Update user in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        hasFaceVerification: false,
        lastFaceVerifyAt: null,
      },
    })

    // Audit log
    await writeAudit({
      action: 'DELETE',
      entity: 'UserFaceVerification',
      entityId: userId,
      entityName: targetUser.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({
      message: 'Face enrollment deleted successfully',
    })
  } catch (error) {
    console.error('Face deletion error:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete face'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId } = await params

    // Check permissions
    if (user.userId !== userId && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'You can only view your own face data' },
        { status: 403 }
      )
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        hasFaceVerification: true,
        lastFaceVerifyAt: true,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      hasFaceVerification: targetUser.hasFaceVerification,
      lastFaceVerifyAt: targetUser.lastFaceVerifyAt,
      canRegister: !targetUser.hasFaceVerification,
    })
  } catch (error) {
    console.error('Error fetching face data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch face data' },
      { status: 500 }
    )
  }
}
