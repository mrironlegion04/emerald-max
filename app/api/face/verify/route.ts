import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyFace, checkFaceServiceHealth, fileToBuffer } from '@/lib/face-service'

export async function POST(request: NextRequest) {
  try {
    // Check if face service is available
    const isHealthy = await checkFaceServiceHealth()
    if (!isHealthy) {
      return NextResponse.json(
        { error: 'Face verification service unavailable' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const userId = formData.get('userId') as string
    const imageFile = formData.get('image') as File

    if (!userId || !imageFile) {
      return NextResponse.json(
        { error: 'Missing userId or image' },
        { status: 400 }
      )
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, hasFaceVerification: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.hasFaceVerification) {
      return NextResponse.json(
        { error: 'User has no face verification enrolled' },
        { status: 400 }
      )
    }

    const imageBuffer = await fileToBuffer(imageFile)

    // Verify face with face service (direct user_id based verification)
    const verifyResult = await verifyFace(userId, imageBuffer)

    return NextResponse.json({
      verified: verifyResult.is_match,
      similarity: verifyResult.similarity,
      distance: verifyResult.distance,
      threshold: verifyResult.threshold,
      message: verifyResult.is_match ? 'Face verified successfully' : 'Face does not match',
    })
  } catch (error) {
    console.error('Face verification error:', error)
    const message = error instanceof Error ? error.message : 'Failed to verify face'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
