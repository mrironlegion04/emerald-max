import { Client } from 'minio'

let minioClient: Client | null = null

/**
 * Get or initialize MinIO client
 */
export function getMinioClient(): Client {
  if (minioClient) {
    return minioClient
  }

  const endpoint = process.env.MINIO_ENDPOINT
  const accessKey = process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_SECRET_KEY
  const useSSL = process.env.MINIO_USE_SSL !== 'false'

  if (!endpoint || !accessKey || !secretKey) {
    throw new Error('MinIO configuration missing: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY required')
  }

  // Parse endpoint - remove protocol if present
  const url = new URL(endpoint.includes('://') ? endpoint : `http://${endpoint}`)
  
  minioClient = new Client({
    endPoint: url.hostname,
    port: url.port ? parseInt(url.port) : (useSSL ? 443 : 80),
    useSSL: useSSL,
    accessKey: accessKey,
    secretKey: secretKey,
    region: process.env.MINIO_REGION || 'us-east-1',
  })

  return minioClient
}

/**
 * Get bucket name from environment
 */
export function getBucketName(): string {
  const bucket = process.env.MINIO_BUCKET_NAME
  if (!bucket) {
    throw new Error('MINIO_BUCKET_NAME environment variable is required')
  }
  return bucket
}

/**
 * Ensure bucket exists, create if not
 */
export async function ensureBucket(): Promise<void> {
  try {
    const client = getMinioClient()
    const bucket = getBucketName()
    
    const exists = await client.bucketExists(bucket)
    if (!exists) {
      await client.makeBucket(bucket, process.env.MINIO_REGION || 'us-east-1')
      console.log(`Created MinIO bucket: ${bucket}`)
    }
  } catch (error) {
    console.error('Failed to ensure bucket exists:', error)
    throw error
  }
}

/**
 * Upload file to MinIO
 */
export async function uploadFile(
  objectName: string,
  fileBuffer: Buffer,
  mimeType: string,
  metadata?: Record<string, string>
): Promise<void> {
  try {
    const client = getMinioClient()
    const bucket = getBucketName()

    await client.putObject(bucket, objectName, fileBuffer, fileBuffer.length, {
      'Content-Type': mimeType,
      ...metadata,
    })
  } catch (error) {
    console.error('Failed to upload file to MinIO:', error)
    throw error
  }
}

/**
 * Generate presigned download URL (valid for 7 days)
 */
export async function getPresignedUrl(objectName: string, expirySeconds: number = 604800): Promise<string> {
  try {
    const client = getMinioClient()
    const bucket = getBucketName()
    
    const url = await client.presignedGetObject(bucket, objectName, expirySeconds)
    return url
  } catch (error) {
    console.error('Failed to generate presigned URL:', error)
    throw error
  }
}

/**
 * Delete file from MinIO
 */
export async function deleteFile(objectName: string): Promise<void> {
  try {
    const client = getMinioClient()
    const bucket = getBucketName()
    
    await client.removeObject(bucket, objectName)
  } catch (error) {
    console.error('Failed to delete file from MinIO:', error)
    throw error
  }
}

/**
 * Check if file exists in MinIO
 */
export async function fileExists(objectName: string): Promise<boolean> {
  try {
    const client = getMinioClient()
    const bucket = getBucketName()
    
    await client.statObject(bucket, objectName)
    return true
  } catch (error: any) {
    if (error.code === 'NotFound') {
      return false
    }
    throw error
  }
}

/**
 * Get file metadata from MinIO
 */
export async function getFileMetadata(objectName: string): Promise<any> {
  try {
    const client = getMinioClient()
    const bucket = getBucketName()
    
    const stat = await client.statObject(bucket, objectName)
    return stat
  } catch (error) {
    console.error('Failed to get file metadata:', error)
    throw error
  }
}

/**
 * Upload face verification photo and return public URL
 */
export async function uploadFacePhoto(userId: string, file: File): Promise<string> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const objectName = `face-verification/${userId}/${Date.now()}-${file.name}`
    
    await uploadFile(objectName, buffer, file.type)
    
    // Return presigned URL valid for 7 days (maximum allowed by MinIO)
    const url = await getPresignedUrl(objectName, 604800)
    return url
  } catch (error) {
    console.error('Failed to upload face photo:', error)
    throw error
  }
}

/**
 * Delete face verification photo by user ID
 */
export async function deleteFacePhoto(userId: string): Promise<void> {
  try {
    const client = getMinioClient()
    const bucket = getBucketName()
    
    // List all photos for this user
    const objectsList: string[] = []
    const stream = await client.listObjects(bucket, `face-verification/${userId}/`, true)
    
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) objectsList.push(obj.name)
      })
      stream.on('error', reject)
      stream.on('end', () => {
        resolve()
      })
    })
    
    // Delete all photos
    if (objectsList.length > 0) {
      await client.removeObjects(bucket, objectsList)
    }
  } catch (error) {
    console.error('Failed to delete face photos:', error)
    throw error
  }
}
