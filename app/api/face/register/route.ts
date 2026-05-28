import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { enrollFace, checkFaceServiceHealth, fileToBuffer } from '@/lib/face-service'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if face service is available
    const isHealthy = await checkFaceServiceHealth()
    if (!isHealthy) {
      return NextResponse.json(
        { error: 'Face verification service unavailable' },
        { status: 503 }
      )
    }

    // Get form data with image
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const imageBuffer = await fileToBuffer(imageFile)

    // Enroll face with face service (user_id is the key, not a separate person_id)
    const faceResult = await enrollFace(user.userId, imageBuffer)

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: {
        hasFaceVerification: true,
        lastFaceVerifyAt: new Date(),
      },
      select: { id: true, name: true, email: true, hasFaceVerification: true },
    })

    // Audit log
    await writeAudit({
      action: 'CREATE',
      entity: 'UserFaceVerification',
      entityId: user.userId,
      entityName: user.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(
      {
        message: 'Face enrolled successfully',
        user: updatedUser,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Face enrollment error:', error)
    const message = error instanceof Error ? error.message : 'Failed to enroll face'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
