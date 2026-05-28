/**
 * Face Verification Service Integration (Simplified for CMMS)
 * Direct user_id based matching - no searching or generic person records
 * Supports both JWT Bearer token and API Key authentication
 */

const FACE_SERVICE_URL = process.env.NEXT_PUBLIC_FACE_SERVICE_URL || process.env.FACE_SERVICE_URL || 'http://localhost:8000'
const FACE_API_SECRET = process.env.FACE_API_SECRET

// Build authorization headers
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  
  if (FACE_API_SECRET) {
    headers['X-API-Key'] = FACE_API_SECRET
  }
  
  return headers
}

export interface FaceEnrollResponse {
  user_id: string
  enrolled: boolean
  message: string
}

export interface FaceVerifyResponse {
  user_id: string
  is_match: boolean
  similarity: number
  distance: number
  threshold: number
}

export interface EnrollmentStatus {
  user_id: string
  enrolled: boolean
}

/**
 * Enroll a user's face with the face verification service
 * Uses direct user_id based storage
 */
export async function enrollFace(
  userId: string,
  imageBuffer: Buffer
): Promise<FaceEnrollResponse> {
  const formData = new FormData()
  formData.append('image', new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' }), 'face.jpg')

  const response = await fetch(`${FACE_SERVICE_URL}/users/${userId}/enroll`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `Face enrollment failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Verify if an uploaded image matches the user's enrolled face
 * Direct 1:1 verification - CMMS already knows the user
 */
export async function verifyFace(
  userId: string,
  imageBuffer: Buffer
): Promise<FaceVerifyResponse> {
  const formData = new FormData()
  formData.append('image', new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' }), 'face.jpg')

  const response = await fetch(`${FACE_SERVICE_URL}/users/${userId}/verify`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `Face verification failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Remove a user's face enrollment
 */
export async function removeFaceEnrollment(userId: string): Promise<void> {
  const response = await fetch(`${FACE_SERVICE_URL}/users/${userId}/enroll`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || `Failed to remove face enrollment: ${response.statusText}`)
  }
}

/**
 * Check if a user has an enrolled face
 */
export async function checkEnrollmentStatus(userId: string): Promise<EnrollmentStatus> {
  const response = await fetch(`${FACE_SERVICE_URL}/users/${userId}/enrolled`, {
    method: 'GET',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to check enrollment status: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Check if face service is healthy
 */
export async function checkFaceServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${FACE_SERVICE_URL}/health`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Convert file to buffer for sending to face service
 */
export async function fileToBuffer(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
