import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { unlink } from 'fs/promises'
import path from 'path'
import { deleteFile } from '@/lib/minio'

/**
 * Check if MinIO is configured
 */
function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ENDPOINT && process.env.MAX_MINIO_ACCESS_KEY && process.env.MAX_MINIO_SECRET_KEY)
}

/**
 * Extract object name from MinIO presigned URL or local URL
 */
function extractObjectNameFromUrl(url: string): string | null {
  try {
    // If it's a presigned URL (contains ?)
    if (url.includes('?')) {
      const urlObj = new URL(url)
      return decodeURIComponent(urlObj.pathname.replace(/^\//, '').split('/').slice(1).join('/'))
    }
    // If it's a local URL
    if (url.startsWith('/uploads/')) {
      return null // Local file
    }
    return null
  } catch {
    return null
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const useMinIO = isMinioConfigured()

    // Try to delete from MinIO if configured
    if (useMinIO) {
      try {
        const objectName = extractObjectNameFromUrl(attachment.url)
        if (objectName) {
          await deleteFile(objectName)
          console.log(`File deleted from MinIO: ${objectName}`)
        }
      } catch (error) {
        console.error('Failed to delete from MinIO, attempting local deletion:', error)
        // Fall back to local deletion
        try {
          const filepath = path.join(process.cwd(), 'public', attachment.url.replace(/^\//, ''))
          await unlink(filepath)
        } catch { /* file may already be gone */ }
      }
    } else {
      // Delete from local filesystem
      try {
        const filepath = path.join(process.cwd(), 'public', attachment.url.replace(/^\//, ''))
        await unlink(filepath)
      } catch { /* file may already be gone */ }
    }

    // Delete database record
    await prisma.attachment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete failed:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}