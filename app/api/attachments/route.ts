import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canEditWorkOrder, canUploadAssetAttachment, canUploadWOAttachment } from '@/lib/access-control'
import { hasPermission } from '@/lib/permissions'
import {
  uploadFile,
  getPresignedUrl,
  ensureBucket,
} from '@/lib/minio'

const MAX_SIZE    = 10 * 1024 * 1024  // 10 MB
const ALLOWED     = ['image/jpeg','image/png','image/gif','image/webp','application/pdf',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv']

/**
 * Check if MinIO is configured and available
 */
function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ENDPOINT && process.env.MAX_MINIO_ACCESS_KEY && process.env.MAX_MINIO_SECRET_KEY)
}

/**
 * Generate unique object name for MinIO
 */
function generateObjectName(originalName: string): string {
  const ext = originalName.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 9)
  return `attachments/${timestamp}-${random}.${ext}`
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData   = await req.formData()
    const entityType = formData.get('entityType') as string
    const entityId   = formData.get('entityId')   as string
    const files      = formData.getAll('file') as File[]

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId required' }, { status: 400 })
    }

    // Validate entity type
    if (!['workOrder', 'asset', 'part', 'comment'].includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
    }

    // Validate entity exists and is within the user's scope
    if (entityType === 'workOrder') {
      const access = await canUploadWOAttachment(user, entityId)
      if (!access.allowed) {
        return NextResponse.json({ error: access.reason ?? 'Forbidden' }, { status: 403 })
      }
    } else if (entityType === 'asset') {
      if (!(await canUploadAssetAttachment(user, entityId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (entityType === 'part') {
      const part = await prisma.part.findUnique({ where: { id: entityId } })
      if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 })
      if (!(await hasPermission(user, 'part:edit'))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (entityType === 'comment') {
      const comment = await prisma.workOrderComment.findUnique({
        where: { id: entityId },
        select: { workOrderId: true },
      })
      if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
      const access = await canEditWorkOrder(user, comment.workOrderId)
      if (!access.allowed) {
        return NextResponse.json({ error: access.reason ?? 'Forbidden' }, { status: 403 })
      }
    }

    if (!isMinioConfigured()) {
      return NextResponse.json({ error: 'Storage service not configured' }, { status: 503 })
    }

    await ensureBucket()

    const created = []
    for (const file of files) {
      // Server-side validation
      if (!ALLOWED.includes(file.type)) {
        console.warn(`File type not allowed: ${file.type}`)
        continue
      }
      if (file.size > MAX_SIZE) {
        console.warn(`File too large: ${file.name} (${file.size} bytes)`)
        continue
      }

      const buffer = Buffer.from(await file.arrayBuffer())

      const objectName = generateObjectName(file.name)
      await uploadFile(objectName, buffer, file.type, {
        'x-amz-meta-original-name': file.name,
        'x-amz-meta-uploaded-by': user.name || 'unknown',
      })

      const url = await getPresignedUrl(objectName, 604800)
      const expiresAt = new Date(Date.now() + 604800 * 1000)
      console.log(`File uploaded to MinIO: ${objectName}`)

      const data: Record<string, unknown> = {
        filename: file.name.split('.').slice(0, -1).join('.'),
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url,
        uploadedById: user.userId,
        expiresAt,
      }

      if (entityType === 'workOrder') data.workOrderId = entityId
      if (entityType === 'asset') data.assetId = entityId
      if (entityType === 'part') data.partId = entityId
      if (entityType === 'comment') data.commentId = entityId

      const attachment = await prisma.attachment.create({ data: data as never })
      created.push(attachment)
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json({ error: 'Upload failed. Storage service unavailable — please try again.' }, { status: 500 })
  }
}