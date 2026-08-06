import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import {
  uploadFile,
  getPresignedUrl,
  ensureBucket,
} from '@/lib/minio'

const MAX_SIZE = 25 * 1024 * 1024  // 25 MB max
const ALLOWED = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv', 'audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/m4a', 'application/octet-stream'
]

function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ENDPOINT && process.env.MAX_MINIO_ACCESS_KEY && process.env.MAX_MINIO_SECRET_KEY)
}

function generateObjectName(originalName: string): string {
  const ext = originalName.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 9)
  return `chat-attachments/${timestamp}-${random}.${ext}`
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (Max: 25MB)' }, { status: 400 })
    }

    if (file.type && !ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (!isMinioConfigured()) {
      return NextResponse.json({ error: 'Storage service not configured' }, { status: 503 })
    }

    await ensureBucket()
    const objectName = generateObjectName(file.name)
    await uploadFile(objectName, buffer, file.type, {
      'x-amz-meta-original-name': file.name,
      'x-amz-meta-uploaded-by': user.name || 'unknown',
    })
    const url = await getPresignedUrl(objectName, 604800) // valid for 7 days
    console.log(`Chat file uploaded to MinIO: ${objectName}`)

    return NextResponse.json({
      url,
      name: file.name,
      type: file.type,
      size: file.size,
      key: objectName
    }, { status: 201 })
  } catch (error) {
    console.error('Chat file upload failed:', error)
    return NextResponse.json({ error: 'Upload failed. Storage service unavailable — please try again.' }, { status: 500 })
  }
}
