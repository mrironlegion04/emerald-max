import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { uploadFacePhoto, deleteFacePhoto } from '@/lib/minio'

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:8000'
const FACE_API_SECRET = process.env.FACE_API_SECRET

// Build authorization headers
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  
  if (FACE_API_SECRET) {
    headers['X-API-Key'] = FACE_API_SECRET
  }
  
  return headers
}

// POST: Upload face verification photo
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
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to buffer for InsightFace enrollment
    const buffer = Buffer.from(await file.arrayBuffer())

    // Enroll face with InsightFace service
    const enrollFormData = new FormData()
    enrollFormData.append('image', new Blob([buffer], { type: file.type }))
    
    // Upload to MinIO first to get URL
    const photoUrl = await uploadFacePhoto(userId, file)
    enrollFormData.append('image_url', photoUrl)

    const enrollRes = await fetch(`${FACE_SERVICE_URL}/users/${userId}/enroll`, {
      method: 'POST',
      body: enrollFormData,
      headers: getAuthHeaders(),
    })

    if (!enrollRes.ok) {
      const enrollError = await enrollRes.json()
      
      // Handle different error formats
      if (enrollRes.status === 409) {
        // Duplicate face detected - preserve structured error for frontend to fetch user name
        if (typeof enrollError.detail === 'object') {
          return NextResponse.json(
            {
              error: 'Duplicate face detected',
              details: enrollError.detail,
              type: 'DUPLICATE_FACE'
            },
            { status: 409 }
          )
        } else {
          return NextResponse.json(
            { error: `Face already registered: ${enrollError.detail}` },
            { status: 409 }
          )
        }
      } else if (enrollRes.status === 422) {
        // Face detection failed
        return NextResponse.json(
          { error: enrollError.detail || 'Could not detect face in image. Try a clearer photo.' },
          { status: 422 }
        )
      } else {
        const errorMessage = typeof enrollError.detail === 'object' 
          ? enrollError.detail.message || 'Failed to process face'
          : enrollError.detail || 'Failed to enroll face'
        return NextResponse.json(
          { error: errorMessage },
          { status: enrollRes.status }
        )
      }
    }

    // Update user with photo URL
    const user = await prisma.user.update({
      where: { id: userId },
      data: { facePhotoUrl: photoUrl },
    })

    return NextResponse.json({
      success: true,
      facePhotoUrl: user.facePhotoUrl,
      message: 'Face photo uploaded and enrolled successfully',
    })
  } catch (error) {
    console.error('Face photo upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload face photo' },
      { status: 500 }
    )
  }
}

// DELETE: Remove face verification photo
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

    // Get current user to find photo URL
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete enrollment from InsightFace service
    try {
      const deleteRes = await fetch(`${FACE_SERVICE_URL}/users/${userId}/enroll`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!deleteRes.ok) {
        console.warn(`Warning: Failed to delete face enrollment from service for user ${userId}`)
      }
    } catch (err) {
      console.warn(`Warning: Could not reach face service to delete enrollment: ${err}`)
      // Continue anyway - just update DB
    }

    // Delete from MinIO if exists
    if (user.facePhotoUrl) {
      try {
        await deleteFacePhoto(userId)
      } catch (err) {
        console.error('Error deleting photo from MinIO:', err)
        // Continue anyway - just update DB
      }
    }

    // Update user to remove photo URL
    await prisma.user.update({
      where: { id: userId },
      data: { facePhotoUrl: null },
    })

    return NextResponse.json({
      success: true,
      message: 'Face photo and enrollment removed',
    })
  } catch (error) {
    console.error('Face photo deletion error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete face photo' },
      { status: 500 }
    )
  }
}
