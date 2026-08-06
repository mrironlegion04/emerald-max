import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { canWriteToAssets } from '@/lib/access-control'
import {
  uploadFile,
  getPresignedUrl,
  ensureBucket,
} from '@/lib/minio'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB for images
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * Check if MinIO is configured
 */
function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ENDPOINT && process.env.MAX_MINIO_ACCESS_KEY && process.env.MAX_MINIO_SECRET_KEY)
}

/**
 * Generate unique object name for MinIO
 */
function generateObjectName(assetId: string, originalName: string): string {
  const ext = originalName.split('.').pop() ?? 'jpg'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 9)
  return `assets/${assetId}/${timestamp}-${random}.${ext}`
}

/**
 * POST: Upload a primary photo for an asset
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    // Verify asset exists
    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (!(await canWriteToAssets(user, [id]))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('photo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    if (!isMinioConfigured()) {
      return NextResponse.json({ error: 'Storage service not configured' }, { status: 503 })
    }

    await ensureBucket()

    const buffer = Buffer.from(await file.arrayBuffer())

    const objectName = generateObjectName(id, file.name)
    await uploadFile(objectName, buffer, file.type, {
      'x-amz-meta-original-name': file.name,
      'x-amz-meta-uploaded-by': user.name || 'unknown',
      'x-amz-meta-asset-id': id,
    })

    // Generate presigned URL (7 days max for MinIO)
    const photoUrl = await getPresignedUrl(objectName, 604800)
    const photoName = objectName
    console.log(`Photo uploaded to MinIO: ${objectName}`)

    // Update asset with photo URL
    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: {
        imageUrl: photoUrl,
        imageName: photoName,
      },
    })

    await writeAudit({
      action: 'UPDATE',
      entity: 'Asset',
      entityId: id,
      entityName: asset.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({
      id: updatedAsset.id,
      imageUrl: updatedAsset.imageUrl,
      imageName: updatedAsset.imageName,
    }, { status: 200 })
  } catch (error) {
    console.error('Photo upload failed:', error)
    return NextResponse.json({ error: 'Failed to upload photo. Storage service unavailable — please try again.' }, { status: 500 })
  }
}

/**
 * DELETE: Remove the primary photo from an asset
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    // Verify asset exists
    const asset = await prisma.asset.findUnique({ where: { id } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (!(await canWriteToAssets(user, [id]))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update asset to remove photo
    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: {
        imageUrl: null,
        imageName: null,
      },
    })

    await writeAudit({
      action: 'UPDATE',
      entity: 'Asset',
      entityId: id,
      entityName: asset.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Photo deletion failed:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}
