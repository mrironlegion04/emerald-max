import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import {
  uploadFile,
  getPresignedUrl,
  ensureBucket,
  deleteFile,
} from '@/lib/minio'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 25 * 1024 * 1024  // 25 MB max
const ALLOWED = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]

function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ENDPOINT && process.env.MAX_MINIO_ACCESS_KEY && process.env.MAX_MINIO_SECRET_KEY)
}

function generateObjectName(originalName: string): string {
  const ext = originalName.split('.').pop() ?? 'bin'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 9)
  return `procedure-attachments/${timestamp}-${random}.${ext}`
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
    let url = `/uploads/${file.name}`
    let key = `local-${Date.now()}`

    const useMinIO = isMinioConfigured()
    if (useMinIO) {
      try {
        await ensureBucket()
        const objectName = generateObjectName(file.name)
        await uploadFile(objectName, buffer, file.type, {
          'x-amz-meta-original-name': file.name,
          'x-amz-meta-uploaded-by': user.name || 'unknown',
        })
        url = await getPresignedUrl(objectName, 604800) // valid for 7 days
        key = objectName
        console.log(`Procedure attachment uploaded to MinIO: ${objectName}`)
      } catch (uploadError) {
        console.error('MinIO procedure upload failed, falling back to local storage:', uploadError)
        await mkdir(UPLOAD_DIR, { recursive: true })
        const ext = file.name.split('.').pop() ?? 'bin'
        const filename = `proc-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const filepath = path.join(UPLOAD_DIR, filename)
        await writeFile(filepath, buffer)
        url = `/uploads/${filename}`
        key = filename
      }
    } else {
      await mkdir(UPLOAD_DIR, { recursive: true })
      const ext = file.name.split('.').pop() ?? 'bin'
      const filename = `proc-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const filepath = path.join(UPLOAD_DIR, filename)
      await writeFile(filepath, buffer)
      url = `/uploads/${filename}`
      key = filename
    }

    return NextResponse.json({
      url,
      name: file.name,
      type: file.type,
      size: file.size,
      key
    }, { status: 201 })
  } catch (error) {
    console.error('Procedure file upload failed:', error)
    return NextResponse.json({ error: 'File upload failure' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')
    const url = searchParams.get('url')

    if (!key && !url) {
      return NextResponse.json({ error: 'Missing key or url parameter' }, { status: 400 })
    }

    const useMinIO = isMinioConfigured()

    // 1. If key is passed and is a MinIO object name
    if (key && !key.startsWith('local-')) {
      if (useMinIO) {
        try {
          await deleteFile(key)
          console.log(`Successfully deleted file from MinIO with key: ${key}`)
        } catch (err) {
          console.error(`Failed to delete key ${key} from MinIO:`, err)
        }
      }
    }

    // 2. If it's a local file or fallback file, delete locally
    let localUrl = url
    if (!localUrl && key && key.startsWith('local-')) {
      // It was a local fallback file, which might not haveurl passed but we can try to infer or ignore if url is blank
    }

    if (localUrl && localUrl.startsWith('/uploads/')) {
      try {
        const filename = path.basename(localUrl)
        const filepath = path.join(UPLOAD_DIR, filename)
        await unlink(filepath)
        console.log(`Successfully deleted local file from uploads: ${filename}`)
      } catch (err) {
        console.error(`Failed to delete local file: ${localUrl}`, err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete uploaded file failed:', error)
    return NextResponse.json({ error: 'Delete file failure' }, { status: 500 })
  }
}

