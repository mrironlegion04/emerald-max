import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import {
  uploadFile,
  getPresignedUrl,
  ensureBucket,
  getMinioClient,
} from '@/lib/minio'

const UPLOAD_DIR  = path.join(process.cwd(), 'public', 'uploads')
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
    if (!['workOrder', 'asset', 'part'].includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 })
    }

    // Validate entity exists
    if (entityType === 'workOrder') {
      const wo = await prisma.workOrder.findUnique({ where: { id: entityId } })
      if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    } else if (entityType === 'asset') {
      const asset = await prisma.asset.findUnique({ where: { id: entityId } })
      if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    } else if (entityType === 'part') {
      const part = await prisma.part.findUnique({ where: { id: entityId } })
      if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    }

    // Initialize MinIO if configured
    const useMinIO = isMinioConfigured()
    if (useMinIO) {
      try {
        await ensureBucket()
      } catch (error) {
        console.error('MinIO initialization failed, falling back to local storage:', error)
      }
    }

    // Ensure local upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true })

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
      let url = `/uploads/${file.name}`
      let expiresAt: Date | null = null

      try {
        // Try MinIO upload first
        if (useMinIO) {
          const objectName = generateObjectName(file.name)
          await uploadFile(objectName, buffer, file.type, {
            'x-amz-meta-original-name': file.name,
            'x-amz-meta-uploaded-by': user.name || 'unknown',
          })

          // Generate presigned URL (7 days expiry)
          url = await getPresignedUrl(objectName, 604800)
          expiresAt = new Date(Date.now() + 604800 * 1000)
          console.log(`File uploaded to MinIO: ${objectName}`)
        } else {
          // Fall back to local filesystem
          const ext = file.name.split('.').pop() ?? 'bin'
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const filepath = path.join(UPLOAD_DIR, filename)
          await writeFile(filepath, buffer)
          url = `/uploads/${filename}`
          console.log(`File uploaded locally: ${filename}`)
        }
      } catch (uploadError) {
        console.error('Upload failed:', uploadError)
        // Try local fallback if MinIO upload fails
        if (useMinIO) {
          const ext = file.name.split('.').pop() ?? 'bin'
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const filepath = path.join(UPLOAD_DIR, filename)
          await writeFile(filepath, buffer)
          url = `/uploads/${filename}`
          console.log(`MinIO upload failed, fell back to local storage: ${filename}`)
        } else {
          throw uploadError
        }
      }

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

      const attachment = await prisma.attachment.create({ data: data as never })
      created.push(attachment)
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}