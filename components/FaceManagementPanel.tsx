'use client'

import { useState, useEffect } from 'react'
import { Settings, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import FaceUploadPanel from './FaceUploadPanel'

interface FaceData {
  hasFaceVerification: boolean
  lastFaceVerifyAt: string | null
  canRegister: boolean
}

export default function FaceManagementPanel({ userId }: { userId: string }) {
  const [faceData, setFaceData] = useState<FaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetchFaceData()
  }, [userId])

  const fetchFaceData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/face/${userId}`)
      if (!response.ok) throw new Error('Failed to fetch face data')
      const data = await response.json()
      setFaceData(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error loading face data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure? This will remove your face verification.')) return

    try {
      setDeleting(true)
      setError(null)

      const response = await fetch(`/api/face/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete face')
      }

      setFaceData({
        hasFaceVerification: false,
        lastFaceVerifyAt: null,
        canRegister: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error deleting face'
      setError(msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleUploadSuccess = () => {
    setShowUpload(false)
    fetchFaceData()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-400">Loading face verification status...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Face Verification
            </h2>
            <p className="text-xs text-gray-500 mt-1">Manage your facial biometric data</p>
          </div>
        </div>

        {/* Status */}
        <div className="mb-6 p-4 rounded-lg border">
          {faceData?.hasFaceVerification ? (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-green-700">✓ Face Registered</p>
                <p className="text-xs text-green-600 mt-1">
                  You can use face verification for login and check-in
                </p>
                {faceData.lastFaceVerifyAt && (
                  <p className="text-xs text-green-600 mt-2">
                    Last verified: {new Date(faceData.lastFaceVerifyAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-blue-700">No Face Registered</p>
                <p className="text-xs text-blue-600 mt-1">
                  Register your face to enable biometric verification
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">❌ {error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {faceData?.hasFaceVerification ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full btn-danger text-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Face Data
            </button>
          ) : (
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="w-full btn-primary text-sm"
            >
              {showUpload ? 'Cancel' : 'Register Face'}
            </button>
          )}
        </div>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <FaceUploadPanel
          onSuccess={handleUploadSuccess}
          onError={msg => setError(msg)}
          userId={userId}
        />
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ How Face Verification Works</h3>
        <ul className="text-xs text-blue-800 space-y-2">
          <li>✓ Your face is captured and converted into a unique mathematical pattern (embedding)</li>
          <li>✓ This pattern is stored securely in our system</li>
          <li>✓ During login/check-in, your photo is compared against this stored pattern</li>
          <li>✓ If there's a strong match, you're instantly verified</li>
        </ul>
      </div>

      {/* Privacy Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">🔒 Privacy & Security</h3>
        <p className="text-xs text-gray-600">
          Your face data is encrypted and never shared with third parties. You can delete your face
          registration at any time.
        </p>
      </div>
    </div>
  )
}
